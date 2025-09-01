/**
 * @fileoverview Security & Ticket Hardening System v1.0 RC
 * Implements cryptographic ticket system with HMAC signatures, TTL enforcement,
 * nonce uniqueness, and key rotation per arbiter.assembly.cue specification
 */

import { z } from 'zod';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// =============================================================================
// SECURITY SCHEMA DEFINITIONS
// =============================================================================

/**
 * Ticket security configuration
 */
export const TicketSecurityConfigSchema = z.object({
  signature_algorithm: z.enum(['HMAC-SHA256']).default('HMAC-SHA256'),
  canonical_format: z.string().default('sorted_hunks|LF_newlines|UTF8|no_BOM'),
  max_ttl_hours: z.number().min(1).max(24).default(24),
  grace_period_minutes: z.number().min(0).max(60).default(5),
  nonce_bytes: z.number().min(16).max(64).default(32),
  key_rotation_interval_hours: z.number().min(1).default(168) // 1 week
}).strict();

export type TicketSecurityConfig = z.infer<typeof TicketSecurityConfigSchema>;

/**
 * Ticket structure with security components
 */
export const TicketSchema = z.object({
  // Core ticket data
  base_commit: z.string().min(1).describe('Git commit hash this ticket is bound to'),
  repo_id: z.string().min(1).describe('Repository identifier'),
  patch_content: z.string().describe('Canonical patch content'),
  
  // Security components
  kid: z.string().describe('Key identifier for HMAC verification'),
  nonce: z.string().describe('Unique nonce for replay protection'),
  exp: z.number().describe('Expiration timestamp (Unix epoch seconds)'),
  iat: z.number().describe('Issued at timestamp (Unix epoch seconds)'),
  hmac: z.string().describe('HMAC signature over canonical content'),
  
  // Metadata
  version: z.string().default('v1.0.0').describe('Ticket format version')
}).strict();

export type Ticket = z.infer<typeof TicketSchema>;

/**
 * Key material for HMAC operations
 */
export const KeyMaterialSchema = z.object({
  kid: z.string().describe('Key identifier'),
  key: z.string().describe('Base64-encoded HMAC key'),
  created_at: z.number().describe('Key creation timestamp'),
  expires_at: z.number().optional().describe('Key expiration timestamp'),
  active: z.boolean().default(true).describe('Whether key is active for signing')
}).strict();

export type KeyMaterial = z.infer<typeof KeyMaterialSchema>;

/**
 * Nonce tracking for replay protection
 */
export const NonceRecordSchema = z.object({
  repo_id: z.string(),
  nonce: z.string(),
  ticket_id: z.string(),
  used_at: z.number().describe('When nonce was first used'),
  expires_at: z.number().describe('When this record can be purged')
}).strict();

export type NonceRecord = z.infer<typeof NonceRecordSchema>;

// =============================================================================
// CANONICAL FORMATTING
// =============================================================================

/**
 * Canonicalize patch content according to specification
 */
export function canonicalizePatch(patchContent: string): string {
  // 1. Ensure UTF-8 encoding (JavaScript strings are UTF-16, but we work with UTF-8 concepts)
  // 2. Remove BOM if present
  let canonical = patchContent.replace(/^\uFEFF/, '');
  
  // 3. Normalize line endings to LF
  canonical = canonical.replace(/\r\n|\r/g, '\n');
  
  // 4. Sort hunks within the patch
  canonical = sortPatchHunks(canonical);
  
  // 5. Ensure trailing newline
  if (!canonical.endsWith('\n')) {
    canonical += '\n';
  }
  
  return canonical;
}

/**
 * Sort hunks within a patch for consistent ordering
 */
function sortPatchHunks(patch: string): string {
  const lines = patch.split('\n');
  const hunks: Array<{ header: string; lines: string[]; startLine: number }> = [];
  let currentHunk: { header: string; lines: string[]; startLine: number } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('@@')) {
      // New hunk header
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      
      // Extract start line number for sorting
      const match = line.match(/@@ -(\d+)/);
      const startLine = match ? parseInt(match[1], 10) : 0;
      
      currentHunk = {
        header: line,
        lines: [],
        startLine
      };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }
  
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  
  // Sort hunks by starting line number
  hunks.sort((a, b) => a.startLine - b.startLine);
  
  // Reconstruct patch
  const sortedLines: string[] = [];
  for (const hunk of hunks) {
    sortedLines.push(hunk.header);
    sortedLines.push(...hunk.lines);
  }
  
  return sortedLines.join('\n');
}

// =============================================================================
// HMAC OPERATIONS
// =============================================================================

/**
 * Generate HMAC signature for ticket content
 */
export function generateTicketHmac(
  key: string,
  baseCommit: string,
  repoId: string,
  nonce: string,
  exp: number,
  canonicalPatch: string
): string {
  // Construct canonical message: base_commit|repo_id|nonce|exp|patch
  const message = [
    baseCommit,
    repoId,
    nonce,
    exp.toString(),
    canonicalPatch
  ].join('|');
  
  // Generate HMAC-SHA256
  const hmac = createHmac('sha256', Buffer.from(key, 'base64'));
  hmac.update(message, 'utf8');
  return hmac.digest('base64');
}

/**
 * Verify HMAC signature for ticket
 */
export function verifyTicketHmac(
  key: string,
  ticket: Ticket
): boolean {
  try {
    const expectedHmac = generateTicketHmac(
      key,
      ticket.base_commit,
      ticket.repo_id,
      ticket.nonce,
      ticket.exp,
      ticket.patch_content
    );
    
    const providedHmac = Buffer.from(ticket.hmac, 'base64');
    const expectedHmacBuffer = Buffer.from(expectedHmac, 'base64');
    
    // Constant-time comparison to prevent timing attacks
    return providedHmac.length === expectedHmacBuffer.length &&
           timingSafeEqual(providedHmac, expectedHmacBuffer);
  } catch {
    return false;
  }
}

// =============================================================================
// KEY MANAGEMENT
// =============================================================================

export class KeyManager {
  private keys: Map<string, KeyMaterial> = new Map();
  private activeKeyId: string | null = null;
  private config: TicketSecurityConfig;
  
  constructor(config: TicketSecurityConfig = {}) {
    this.config = TicketSecurityConfigSchema.parse(config);
  }
  
  /**
   * Generate new HMAC key
   */
  generateKey(): KeyMaterial {
    const kid = this.generateKeyId();
    const key = randomBytes(32).toString('base64'); // 256-bit key
    const now = Math.floor(Date.now() / 1000);
    
    return {
      kid,
      key,
      created_at: now,
      expires_at: now + (this.config.key_rotation_interval_hours * 3600),
      active: true
    };
  }
  
  /**
   * Add key to manager
   */
  addKey(keyMaterial: KeyMaterial): void {
    this.keys.set(keyMaterial.kid, keyMaterial);
    
    if (!this.activeKeyId && keyMaterial.active) {
      this.activeKeyId = keyMaterial.kid;
    }
  }
  
  /**
   * Get active signing key
   */
  getActiveKey(): KeyMaterial | null {
    if (!this.activeKeyId) return null;
    return this.keys.get(this.activeKeyId) || null;
  }
  
  /**
   * Get key by ID for verification
   */
  getKey(kid: string): KeyMaterial | null {
    return this.keys.get(kid) || null;
  }
  
  /**
   * Rotate to new active key
   */
  rotateKey(): KeyMaterial {
    const newKey = this.generateKey();
    this.addKey(newKey);
    
    // Deactivate old key but keep for verification
    if (this.activeKeyId) {
      const oldKey = this.keys.get(this.activeKeyId);
      if (oldKey) {
        oldKey.active = false;
        this.keys.set(this.activeKeyId, oldKey);
      }
    }
    
    this.activeKeyId = newKey.kid;
    return newKey;
  }
  
  /**
   * Clean up expired keys
   */
  cleanupExpiredKeys(): string[] {
    const now = Math.floor(Date.now() / 1000);
    const removedKeys: string[] = [];
    
    for (const [kid, keyMaterial] of this.keys.entries()) {
      if (keyMaterial.expires_at && keyMaterial.expires_at < now) {
        this.keys.delete(kid);
        removedKeys.push(kid);
        
        if (this.activeKeyId === kid) {
          this.activeKeyId = null;
        }
      }
    }
    
    return removedKeys;
  }
  
  /**
   * Get all keys (for backup/export)
   */
  getAllKeys(): KeyMaterial[] {
    return Array.from(this.keys.values());
  }
  
  /**
   * Generate unique key identifier
   */
  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `key_${timestamp}_${random}`;
  }
}

// =============================================================================
// NONCE MANAGEMENT & REPLAY PROTECTION
// =============================================================================

export class NonceManager {
  private nonces: Map<string, NonceRecord> = new Map();
  private config: TicketSecurityConfig;
  
  constructor(config: TicketSecurityConfig = {}) {
    this.config = TicketSecurityConfigSchema.parse(config);
  }
  
  /**
   * Generate cryptographically secure nonce
   */
  generateNonce(): string {
    return randomBytes(this.config.nonce_bytes).toString('base64');
  }
  
  /**
   * Check if nonce is unique and record it
   */
  useNonce(repoId: string, nonce: string, ticketId: string): boolean {
    const key = `${repoId}:${nonce}`;
    
    if (this.nonces.has(key)) {
      return false; // Nonce already used (replay attack)
    }
    
    const now = Math.floor(Date.now() / 1000);
    const gracePeriod = this.config.grace_period_minutes * 60;
    const maxTtl = this.config.max_ttl_hours * 3600;
    
    const record: NonceRecord = {
      repo_id: repoId,
      nonce,
      ticket_id: ticketId,
      used_at: now,
      expires_at: now + maxTtl + gracePeriod
    };
    
    this.nonces.set(key, record);
    return true;
  }
  
  /**
   * Clean up expired nonce records
   */
  cleanupExpiredNonces(): number {
    const now = Math.floor(Date.now() / 1000);
    let removed = 0;
    
    for (const [key, record] of this.nonces.entries()) {
      if (record.expires_at < now) {
        this.nonces.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
  
  /**
   * Check if nonce exists (for testing)
   */
  hasNonce(repoId: string, nonce: string): boolean {
    const key = `${repoId}:${nonce}`;
    return this.nonces.has(key);
  }
  
  /**
   * Get all nonce records (for backup/audit)
   */
  getAllNonces(): NonceRecord[] {
    return Array.from(this.nonces.values());
  }
}

// =============================================================================
// TICKET OPERATIONS
// =============================================================================

export class TicketManager {
  private keyManager: KeyManager;
  private nonceManager: NonceManager;
  private config: TicketSecurityConfig;
  
  constructor(
    config: TicketSecurityConfig = {},
    keyManager?: KeyManager,
    nonceManager?: NonceManager
  ) {
    this.config = TicketSecurityConfigSchema.parse(config);
    this.keyManager = keyManager || new KeyManager(this.config);
    this.nonceManager = nonceManager || new NonceManager(this.config);
  }
  
  /**
   * Create new secure ticket
   */
  createTicket(
    baseCommit: string,
    repoId: string,
    patchContent: string,
    ttlHours: number = this.config.max_ttl_hours
  ): Ticket {
    // Validate TTL
    if (ttlHours > this.config.max_ttl_hours) {
      throw new Error(`TTL exceeds maximum allowed: ${ttlHours}h > ${this.config.max_ttl_hours}h`);
    }
    
    // Get active key
    const activeKey = this.keyManager.getActiveKey();
    if (!activeKey) {
      throw new Error('No active signing key available');
    }
    
    // Canonicalize patch content
    const canonicalPatch = canonicalizePatch(patchContent);
    
    // Generate ticket components
    const nonce = this.nonceManager.generateNonce();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (ttlHours * 3600);
    
    // Generate HMAC
    const hmac = generateTicketHmac(
      activeKey.key,
      baseCommit,
      repoId,
      nonce,
      exp,
      canonicalPatch
    );
    
    const ticket: Ticket = {
      base_commit: baseCommit,
      repo_id: repoId,
      patch_content: canonicalPatch,
      kid: activeKey.kid,
      nonce,
      exp,
      iat: now,
      hmac,
      version: 'v1.0.0'
    };
    
    return ticket;
  }
  
  /**
   * Verify ticket authenticity and validity
   */
  async verifyTicket(ticket: Ticket): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Validate ticket structure
      const parseResult = TicketSchema.safeParse(ticket);
      if (!parseResult.success) {
        errors.push(`Invalid ticket structure: ${parseResult.error.message}`);
        return { valid: false, errors, warnings };
      }
      
      // Check TTL
      const now = Math.floor(Date.now() / 1000);
      if (ticket.exp <= now) {
        errors.push(`Ticket expired at ${new Date(ticket.exp * 1000).toISOString()}`);
        return { valid: false, errors, warnings };
      }
      
      // Check issued time is reasonable
      if (ticket.iat > now + 300) { // Allow 5 minutes clock skew
        errors.push('Ticket issued in the future');
        return { valid: false, errors, warnings };
      }
      
      // Check nonce uniqueness (replay protection)
      const ticketId = this.generateTicketId(ticket);
      if (!this.nonceManager.useNonce(ticket.repo_id, ticket.nonce, ticketId)) {
        errors.push('Nonce already used (potential replay attack)');
        return { valid: false, errors, warnings };
      }
      
      // Verify HMAC signature
      const key = this.keyManager.getKey(ticket.kid);
      if (!key) {
        errors.push(`Unknown key identifier: ${ticket.kid}`);
        return { valid: false, errors, warnings };
      }
      
      if (!verifyTicketHmac(key.key, ticket)) {
        errors.push('HMAC signature verification failed');
        return { valid: false, errors, warnings };
      }
      
      // Check if key is expired (warning only)
      if (key.expires_at && key.expires_at < now) {
        warnings.push('Ticket signed with expired key');
      }
      
      // Verify patch canonicalization
      const canonicalPatch = canonicalizePatch(ticket.patch_content);
      if (canonicalPatch !== ticket.patch_content) {
        errors.push('Patch content is not in canonical format');
        return { valid: false, errors, warnings };
      }
      
      return { valid: true, errors, warnings };
      
    } catch (error) {
      errors.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }
  
  /**
   * Generate unique ticket identifier
   */
  private generateTicketId(ticket: Ticket): string {
    const components = [
      ticket.base_commit,
      ticket.repo_id,
      ticket.nonce,
      ticket.exp.toString()
    ];
    
    const hmac = createHmac('sha256', 'ticket-id');
    hmac.update(components.join('|'));
    return hmac.digest('hex');
  }
  
  /**
   * Get managers for external access
   */
  getKeyManager(): KeyManager {
    return this.keyManager;
  }
  
  getNonceManager(): NonceManager {
    return this.nonceManager;
  }
  
  /**
   * Perform maintenance operations
   */
  performMaintenance(): {
    expired_keys_removed: number;
    expired_nonces_removed: number;
  } {
    const expiredKeys = this.keyManager.cleanupExpiredKeys().length;
    const expiredNonces = this.nonceManager.cleanupExpiredNonces();
    
    return {
      expired_keys_removed: expiredKeys,
      expired_nonces_removed: expiredNonces
    };
  }
}

// =============================================================================
// SECURITY VALIDATION HELPERS
// =============================================================================

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: unknown): asserts config is TicketSecurityConfig {
  const result = TicketSecurityConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid security configuration: ${result.error.message}`);
  }
}

/**
 * Generate secure random string
 */
export function generateSecureRandomString(bytes: number = 32): string {
  return randomBytes(bytes).toString('base64');
}

/**
 * Constant-time string comparison
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return timingSafeEqual(bufferA, bufferB);
}