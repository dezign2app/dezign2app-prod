/**
 * PostgreSQL Runner & Schema Manager
 *
 * Modularized into:
 * - ./postgres/types: Interfaces & type definitions (no any/unknown/as)
 * - ./postgres/connection: Connection strings, SSL detection & reachability checks
 * - ./postgres/tableSchema: Table creation, drop, rename operations
 * - ./postgres/liveExecution: Parameterized raw SQL execution & live runner
 * - ./postgres/tableSyncCheck: Schema drift detection (columns, indexes, foreign keys)
 * - ./postgres/tableSyncApply: Schema migration & sync application with prerequisite tables
 */

export * from "./postgres";
