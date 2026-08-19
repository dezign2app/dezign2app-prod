export interface TableSeedRecord {
  id: string; // The generated record _id (e.g. "user_a1b2c3")
  databaseNodeId?: string;
  databaseName: string;
  tableNodeId?: string;
  tableName: string;
  fields: Record<string, string | number | boolean | null>;
}

export interface TestUserPersona {
  id: string;
  name: string; // e.g. "Admin - Acme Tenant"
  description?: string;
  activeAuthToken?: string; // Token used for Authorization: Bearer <token>
  records: TableSeedRecord[];
  createdAt: string;
  updatedAt?: string;
}

export function generateRecordId(tableName: string): string {
  const prefix = (tableName || "rec").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 8);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${randomStr}`;
}

export function generatePersonaId(): string {
  return `persona_${Math.random().toString(36).substring(2, 9)}`;
}
