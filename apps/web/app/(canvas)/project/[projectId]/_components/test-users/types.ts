export interface TableSeedRecord {
  id: string; // The generated record _id (e.g. "user_a1b2c3")
  databaseNodeId?: string;
  databaseName: string;
  tableNodeId?: string;
  tableName: string;
  fields: Record<string, string | number | boolean | null | undefined>;
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

export function isUuid(id?: string | null): id is string {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateRecordId(tableName: string): string {
  const lower = (tableName || "").toLowerCase();
  if (lower === "user" || lower === "session" || lower === "account" || lower === "verification") {
    return generateUuid();
  }
  const prefix = (tableName || "rec").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 8);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${randomStr}`;
}

export function generatePersonaId(): string {
  return `persona_${Math.random().toString(36).substring(2, 9)}`;
}
