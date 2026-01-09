/**
 * @module util/db/types
 * Database types and interfaces.
 */

import type { DatabaseClient } from "../../db/client";

export interface SpecWorkbenchDBOptions {
  client?: DatabaseClient;
}
