import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  syncDatabaseEnvVarsList,
  syncDatabaseLocalEnv,
} from "../databaseEnvSync";
import * as localEnvSync from "../localEnvSync";

vi.mock("../localEnvSync", async () => {
  const actual = await vi.importActual<typeof import("../localEnvSync")>("../localEnvSync");
  return {
    ...actual,
    saveLocalEnvVariable: vi.fn().mockResolvedValue({ success: true }),
    deleteLocalEnvVariable: vi.fn().mockResolvedValue({ success: true }),
  };
});

describe("databaseEnvSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncDatabaseEnvVarsList", () => {
    it("creates both direct and pooled env vars when pooled connection is configured", () => {
      const data = {
        dbEngine: "postgres",
        connectionStringEnv: "DATABASE_URL",
        connectionStringPooledEnv: "DATABASE_URL_POOLED",
        connectionString: "postgresql://user:pass@host:5432/db",
        connectionStringPooled: "postgresql://user:pass@host-pooler:5432/db",
      };

      const result = syncDatabaseEnvVarsList(data as any);
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe("DATABASE_URL");
      expect(result[1]?.name).toBe("DATABASE_URL_POOLED");
    });

    it("creates both direct and pooled env vars when provider is Neon or Supabase even before pooled URI is entered", () => {
      const neonData = {
        dbEngine: "postgres",
        provider: "neon",
        connectionStringEnv: "DATABASE_URL",
        connectionStringPooledEnv: "DATABASE_URL_POOLED",
      };

      const result = syncDatabaseEnvVarsList(neonData as any);
      expect(result).toHaveLength(2);
      expect(result.map((v) => v.name)).toEqual(["DATABASE_URL", "DATABASE_URL_POOLED"]);
    });

    it("removes pooled env var when provider is local and no pooled connection exists", () => {
      const existing = [
        { id: "db-url", name: "DATABASE_URL" },
        { id: "db-url-pooled", name: "DATABASE_URL_POOLED" },
      ];
      const localData = {
        dbEngine: "postgres",
        provider: "local",
        connectionStringEnv: "DATABASE_URL",
        connectionStringPooled: "",
      };

      const result = syncDatabaseEnvVarsList(localData as any, existing);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("DATABASE_URL");
    });

    it("handles SQLite configuration with DB_FILE_PATH and DATABASE_URL", () => {
      const sqliteData = {
        dbEngine: "sqlite",
        dbFilePathEnv: "DB_FILE_PATH",
        connectionStringEnv: "DATABASE_URL",
      };

      const result = syncDatabaseEnvVarsList(sqliteData as any);
      expect(result.map((v) => v.name)).toEqual(["DB_FILE_PATH", "DATABASE_URL"]);
      expect(result.some((v) => v.name === "DATABASE_URL_POOLED")).toBe(false);
    });

    it("preserves custom user-defined environment variables", () => {
      const existing = [
        { id: "db-url", name: "DATABASE_URL" },
        { id: "custom-var-1", name: "MY_CUSTOM_SECRET", description: "Custom" },
      ];
      const data = {
        dbEngine: "postgres",
        provider: "neon",
        connectionString: "postgresql://...",
        connectionStringPooled: "postgresql://...",
      };

      const result = syncDatabaseEnvVarsList(data as any, existing);
      expect(result.map((v) => v.name)).toEqual([
        "DATABASE_URL",
        "DATABASE_URL_POOLED",
        "MY_CUSTOM_SECRET",
      ]);
    });
  });

  describe("syncDatabaseLocalEnv", () => {
    it("saves both direct and pooled values to .env", async () => {
      const prevData = {};
      const nextData = {
        dbEngine: "postgres",
        connectionStringEnv: "DATABASE_URL",
        connectionStringPooledEnv: "DATABASE_URL_POOLED",
        connectionString: "postgresql://user:pass@host:5432/db",
        connectionStringPooled: "postgresql://user:pass@host-pooler:5432/db",
      };

      const { created } = await syncDatabaseLocalEnv(prevData, nextData as any, "proj-1");
      expect(localEnvSync.saveLocalEnvVariable).toHaveBeenCalledWith(
        "DATABASE_URL",
        "postgresql://user:pass@host:5432/db",
        "proj-1",
      );
      expect(localEnvSync.saveLocalEnvVariable).toHaveBeenCalledWith(
        "DATABASE_URL_POOLED",
        "postgresql://user:pass@host-pooler:5432/db",
        "proj-1",
      );
      expect(created).toContain("DATABASE_URL");
      expect(created).toContain("DATABASE_URL_POOLED");
    });

    it("deletes old env key when renamed and saves new key", async () => {
      const prevData = {
        dbEngine: "postgres",
        connectionStringEnv: "DATABASE_URL",
        connectionString: "postgresql://user:pass@host:5432/db",
      };
      const nextData = {
        dbEngine: "postgres",
        connectionStringEnv: "PRIMARY_DB_URL",
        connectionString: "postgresql://user:pass@host:5432/db",
      };

      const { deleted, created } = await syncDatabaseLocalEnv(prevData, nextData as any, "proj-1");
      expect(localEnvSync.deleteLocalEnvVariable).toHaveBeenCalledWith("DATABASE_URL", "proj-1");
      expect(localEnvSync.saveLocalEnvVariable).toHaveBeenCalledWith(
        "PRIMARY_DB_URL",
        "postgresql://user:pass@host:5432/db",
        "proj-1",
      );
      expect(deleted).toContain("DATABASE_URL");
      expect(created).toContain("PRIMARY_DB_URL");
    });

    it("deletes pooled env variable from .env when pooled connection is cleared", async () => {
      const prevData = {
        dbEngine: "postgres",
        provider: "neon",
        connectionStringPooledEnv: "DATABASE_URL_POOLED",
        connectionStringPooled: "postgresql://user:pass@host-pooler:5432/db",
      };
      const nextData = {
        dbEngine: "postgres",
        provider: "local",
        connectionStringPooledEnv: "DATABASE_URL_POOLED",
        connectionStringPooled: "",
      };

      const { deleted } = await syncDatabaseLocalEnv(prevData, nextData as any, "proj-1");
      expect(localEnvSync.deleteLocalEnvVariable).toHaveBeenCalledWith("DATABASE_URL_POOLED", "proj-1");
      expect(deleted).toContain("DATABASE_URL_POOLED");
    });
  });
});
