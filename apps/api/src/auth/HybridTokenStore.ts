/**
 * @module auth/HybridTokenStore
 * Hybrid in-memory and KV token storage for authentication.
 */

import { logger } from "../io/utils";
import type { TokenRecord } from "./types";

/**
 * Hybrid token store that caches in memory and persists to KV when available.
 */
export class HybridTokenStore {
  private memory = new Map<string, TokenRecord>();

  constructor(private kvBinding?: any) {}

  add(token: string, record: TokenRecord): void {
    this.memory.set(token, record);
    if (this.kvBinding?.put) {
      void this.kvBinding.put(token, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 30 });
    }
  }

  async get(token: string): Promise<TokenRecord | null> {
    const cached = this.memory.get(token);
    if (cached) return cached;

    if (this.kvBinding?.get) {
      try {
        const raw = await this.kvBinding.get(token);
        if (raw) {
          const parsed =
            typeof raw === "string" ? (JSON.parse(raw) as TokenRecord) : (raw as TokenRecord);
          this.memory.set(token, parsed);
          return parsed;
        }
      } catch (error) {
        logger.warn("Failed to read token from KV", { error });
      }
    }

    return null;
  }

  delete(token: string): void {
    this.memory.delete(token);
    if (this.kvBinding?.delete) {
      void this.kvBinding.delete(token);
    }
  }

  peek(token: string): TokenRecord | undefined {
    return this.memory.get(token);
  }

  entries(): Array<[string, TokenRecord]> {
    return Array.from(this.memory.entries());
  }

  keys(): IterableIterator<string> {
    return this.memory.keys();
  }
}
