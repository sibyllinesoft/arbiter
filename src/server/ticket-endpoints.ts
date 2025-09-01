/**
 * Ticket System REST API Endpoints
 * 
 * Provides HTTP endpoints for the ticketed mutation system:
 * - POST /v1/ticket - Issue new mutation tickets
 * - POST /v1/verify - Verify tickets and stamps
 * - GET /v1/tickets/stats - Get ticket system statistics
 */

import { Elysia, t } from 'elysia';
import { getTicketSystem, type MutationTicket, type StampedPatch } from './ticket-system.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const TicketRequestSchema = t.Object({
  planHash: t.String({ minLength: 64, maxLength: 64 }), // SHA256 hex
  repoSHA: t.String({ minLength: 40, maxLength: 40 }), // Git SHA hex
  scopes: t.Optional(t.Array(t.String())),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
});

const VerifyTicketSchema = t.Object({
  ticketId: t.String(),
  planHash: t.String({ minLength: 64, maxLength: 64 }),
});

const VerifyStampSchema = t.Object({
  stamp: t.String(),
  ticketId: t.String(),
  repoSHA: t.String({ minLength: 40, maxLength: 40 }),
  planHash: t.String({ minLength: 64, maxLength: 64 }),
  content: t.String(),
});

const CreateStampedPatchSchema = t.Object({
  ticketId: t.String(),
  operation: t.Union([t.Literal('create'), t.Literal('update'), t.Literal('delete')]),
  filePath: t.String(),
  content: t.String(),
  repoSHA: t.String({ minLength: 40, maxLength: 40 }),
  planHash: t.String({ minLength: 64, maxLength: 64 }),
});

/**
 * Create ticket system endpoints for Elysia server
 */
export function createTicketEndpoints() {
  return new Elysia({ prefix: '/v1' })
    
    /**
     * Issue a new mutation ticket
     * POST /v1/ticket
     */
    .post('/ticket', async ({ body, set }) => {
      try {
        const ticketSystem = getTicketSystem();
        
        const ticket = await ticketSystem.issueTicket(
          body.planHash,
          body.repoSHA,
          body.scopes,
          body.metadata
        );

        logger.info(`Issued ticket ${ticket.ticketId} for plan ${body.planHash.substring(0, 8)}...`);

        set.status = 201;
        return {
          success: true,
          ticket: {
            ticketId: ticket.ticketId,
            expiresAt: ticket.expiresAt,
            planHash: ticket.planHash,
            scopes: ticket.scopes,
          },
          message: 'Ticket issued successfully',
        };

      } catch (error) {
        logger.error('Ticket issuance failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'TICKET_ISSUANCE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, {
      body: TicketRequestSchema,
      detail: {
        summary: 'Issue Mutation Ticket',
        description: 'Issue a new ticket for authorized mutations to CUE/spec files',
        tags: ['Tickets'],
      },
    })

    /**
     * Verify a mutation ticket
     * POST /v1/verify/ticket
     */
    .post('/verify/ticket', async ({ body, set }) => {
      try {
        const ticketSystem = getTicketSystem();
        
        const result = await ticketSystem.verifyTicket(body.ticketId, body.planHash);

        if (result.valid) {
          logger.debug(`Ticket ${body.ticketId} verified successfully`);
          return {
            success: true,
            valid: true,
            ticket: result.ticket,
            verifiedAt: result.timestamp,
          };
        } else {
          logger.warn(`Ticket verification failed: ${result.reason}`);
          set.status = 403;
          return {
            success: false,
            valid: false,
            error: 'TICKET_VERIFICATION_FAILED',
            reason: result.reason,
            verifiedAt: result.timestamp,
          };
        }

      } catch (error) {
        logger.error('Ticket verification error:', error);
        set.status = 500;
        return {
          success: false,
          valid: false,
          error: 'VERIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, {
      body: VerifyTicketSchema,
      detail: {
        summary: 'Verify Mutation Ticket',
        description: 'Verify that a ticket is valid for the specified plan',
        tags: ['Tickets'],
      },
    })

    /**
     * Verify HMAC stamp
     * POST /v1/verify/stamp
     */
    .post('/verify/stamp', async ({ body, set }) => {
      try {
        const ticketSystem = getTicketSystem();
        
        const result = ticketSystem.verifyStamp(
          body.stamp,
          body.ticketId,
          body.repoSHA,
          body.planHash,
          body.content
        );

        if (result.valid) {
          logger.debug(`Stamp verified successfully for ticket ${body.ticketId}`);
          return {
            success: true,
            valid: true,
            verifiedAt: result.timestamp,
          };
        } else {
          logger.warn(`Stamp verification failed: ${result.reason}`);
          set.status = 403;
          return {
            success: false,
            valid: false,
            error: 'STAMP_VERIFICATION_FAILED',
            reason: result.reason,
            verifiedAt: result.timestamp,
          };
        }

      } catch (error) {
        logger.error('Stamp verification error:', error);
        set.status = 500;
        return {
          success: false,
          valid: false,
          error: 'VERIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, {
      body: VerifyStampSchema,
      detail: {
        summary: 'Verify HMAC Stamp',
        description: 'Verify the HMAC stamp for a patch against server key',
        tags: ['Tickets'],
      },
    })

    /**
     * Create stamped patch
     * POST /v1/patch/create
     */
    .post('/patch/create', async ({ body, set }) => {
      try {
        const ticketSystem = getTicketSystem();
        
        const patch = await ticketSystem.createStampedPatch(
          body.ticketId,
          body.operation,
          body.filePath,
          body.content,
          body.repoSHA,
          body.planHash
        );

        const formattedBlock = ticketSystem.formatStampedBlock(patch);

        logger.info(`Created stamped patch ${patch.id} for ${body.filePath}`);

        set.status = 201;
        return {
          success: true,
          patch: {
            id: patch.id,
            stamp: patch.stamp,
            ticketId: patch.ticketId,
            operation: patch.operation,
            filePath: patch.filePath,
          },
          formattedBlock,
          message: 'Stamped patch created successfully',
        };

      } catch (error) {
        logger.error('Stamped patch creation failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'PATCH_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, {
      body: CreateStampedPatchSchema,
      detail: {
        summary: 'Create Stamped Patch',
        description: 'Create a cryptographically signed patch for file modifications',
        tags: ['Patches'],
      },
    })

    /**
     * Get ticket system statistics
     * GET /v1/tickets/stats
     */
    .get('/tickets/stats', ({ set }) => {
      try {
        const ticketSystem = getTicketSystem();
        const stats = ticketSystem.getTicketStats();

        return {
          success: true,
          stats: {
            activeTickets: stats.activeTickets,
            totalIssued: stats.totalIssued,
            oldestTicket: stats.oldestTicket,
            newestTicket: stats.newestTicket,
          },
          timestamp: new Date().toISOString(),
        };

      } catch (error) {
        logger.error('Stats retrieval failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'STATS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, {
      detail: {
        summary: 'Get Ticket Statistics',
        description: 'Retrieve current ticket system statistics',
        tags: ['Tickets'],
      },
    })

    /**
     * Revoke a ticket (emergency endpoint)
     * DELETE /v1/ticket/:ticketId
     */
    .delete('/ticket/:ticketId', async ({ params, body, set }) => {
      try {
        const ticketSystem = getTicketSystem();
        const { reason } = body as { reason?: string };
        
        const revoked = ticketSystem.revokeTicket(
          params.ticketId, 
          reason || 'Manual revocation'
        );

        if (revoked) {
          logger.warn(`Revoked ticket ${params.ticketId}`);
          return {
            success: true,
            message: 'Ticket revoked successfully',
            ticketId: params.ticketId,
            revokedAt: new Date().toISOString(),
          };
        } else {
          set.status = 404;
          return {
            success: false,
            error: 'TICKET_NOT_FOUND',
            message: 'Ticket not found or already expired',
          };
        }

      } catch (error) {
        logger.error('Ticket revocation failed:', error);
        set.status = 500;
        return {
          success: false,
          error: 'REVOCATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, {
      body: t.Optional(t.Object({
        reason: t.Optional(t.String()),
      })),
      detail: {
        summary: 'Revoke Ticket',
        description: 'Emergency revocation of an active ticket',
        tags: ['Tickets'],
      },
    })

    /**
     * Health check endpoint
     * GET /v1/tickets/health
     */
    .get('/tickets/health', () => {
      try {
        const ticketSystem = getTicketSystem();
        const cleaned = ticketSystem.cleanupExpiredTickets();
        
        return {
          success: true,
          status: 'healthy',
          cleanedExpiredTickets: cleaned,
          timestamp: new Date().toISOString(),
        };

      } catch (error) {
        return {
          success: false,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      }
    }, {
      detail: {
        summary: 'Health Check',
        description: 'Check ticket system health and clean up expired tickets',
        tags: ['Health'],
      },
    });
}

/**
 * Middleware to require valid ticket for protected endpoints
 */
export function requireValidTicket() {
  return new Elysia()
    .derive(async ({ headers, set, request }) => {
      const ticketId = headers['x-arbiter-ticket'];
      const planHash = headers['x-arbiter-plan-hash'];

      if (!ticketId || !planHash) {
        set.status = 401;
        return {
          success: false,
          error: 'MISSING_TICKET_HEADERS',
          message: 'Required headers: X-Arbiter-Ticket, X-Arbiter-Plan-Hash',
        };
      }

      try {
        const ticketSystem = getTicketSystem();
        const verification = await ticketSystem.verifyTicket(ticketId, planHash);

        if (!verification.valid) {
          set.status = 403;
          return {
            success: false,
            error: 'INVALID_TICKET',
            message: verification.reason,
          };
        }

        // Add ticket info to context
        return {
          ticket: verification.ticket!,
          ticketId,
          planHash,
        };

      } catch (error) {
        logger.error('Ticket middleware error:', error);
        set.status = 500;
        return {
          success: false,
          error: 'TICKET_VERIFICATION_ERROR',
          message: 'Failed to verify ticket',
        };
      }
    });
}

export default createTicketEndpoints;