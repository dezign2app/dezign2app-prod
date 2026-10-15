/**
 * Compiler-layer types for test persona seed data.
 * These mirror the canvas-layer TestUserPersona without importing from
 * the UI component tree.
 */

export interface PersonaSeedRecord {
  id?: string;
  databaseNodeId?: string;
  databaseName?: string;
  tableNodeId?: string;
  tableName: string;
  fields: Record<string, string | number | boolean | null | undefined>;
}

export interface PersonaSeed {
  id: string;
  name: string;
  description?: string;
  activeAuthToken?: string;
  records: PersonaSeedRecord[];
  createdAt?: string;
  updatedAt?: string;
}
