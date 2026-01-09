/**
 * Shared types for project route handlers
 */
import type { Context } from "hono";
import type { Dependencies } from "../types";

export type HandlerContext = Context;

export type HandlerDependencies = Dependencies;

export type DbInstance = Record<string, Function>;

export type ArtifactRecord = Record<string, unknown>;

export type ProjectRecord = Record<string, unknown>;
